import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const stub = readFileSync("scripts/supabase-stub.sql", "utf8");
const migration = readFileSync("supabase/migrations/0001_init.sql", "utf8");

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-00000000000c";
const SUPER = "00000000-0000-4000-8000-00000000000d";

let db: PGlite;

async function as<T = any>(uid: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [uid ? JSON.stringify({ sub: uid }) : ""]);
    const res = await tx.query<{ r: T }>(sql, params);
    return res.rows[0]?.r as T;
  }) as Promise<T>;
}

const save = (uid: string | null, ward: string, extra: object = {}) =>
  as<{ id: string; no: number }>(uid, `select public.admin_save_wish($1::jsonb) as r`, [
    JSON.stringify({ ward_id: ward, public_name: "Амир", age: 8, wish_title: "Футбольный мяч", ...extra }),
  ]);
const book = (uid: string | null, id: string) => as(uid, `select public.book_wish($1::uuid) as r`, [id]);
const tree = (uid: string | null = null) => as<any>(uid, `select public.get_tree() as r`);
const setTree = async (patch: object) => {
  const current = (await db.query<{ value: object }>(`select value from settings where key = 'tree'`)).rows[0].value;
  await db.query(`update settings set value = $1::jsonb where key = 'tree'`, [JSON.stringify({ ...current, ...patch })]);
};

beforeEach(async () => {
  db = new PGlite();
  await db.exec(stub);
  await db.exec(migration);
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at) values
      ($1, 'alice@example.com', now()), ($2, 'bob@example.com', now()),
      ($3, 'admin@example.com', now()), ($4, 'super@example.com', now())`,
    [ALICE, BOB, ADMIN, SUPER],
  );
  await db.exec(`insert into admins (email, role) values ('admin@example.com', 'admin'), ('super@example.com', 'super_admin')`);
});

describe("доступ к данным", () => {
  it("анонимы и пользователи не читают таблицы напрямую", async () => {
    await save(ADMIN, "ONA-1");
    for (const table of ["wishes", "bookings", "profiles", "admins", "audit_log", "settings"]) {
      await expect(as(null, `select count(*) as r from public.${table}`)).rejects.toThrow(/permission denied/);
      await expect(as(ALICE, `select count(*) as r from public.${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("служебная заметка не попадает в публичные ответы, а фото только с согласия", async () => {
    const { id } = await save(ADMIN, "ONA-1", { admin_note: "секрет", photo_path: "a/photo.jpg", photo_public: false });
    const wish = await as<any>(null, `select public.get_wish($1::uuid) as r`, [id]);
    expect(wish.photo_path).toBeNull();
    expect(JSON.stringify(wish)).not.toContain("секрет");
    expect(JSON.stringify(await tree())).not.toContain("секрет");
    expect(await as(null, `select public.storage_object_is_public($1) as r`, ["a/photo.jpg"])).toBe(false);

    await save(ADMIN, "ONA-1", { id, photo_path: "a/photo.jpg", photo_public: true });
    expect((await as<any>(null, `select public.get_wish($1::uuid) as r`, [id])).photo_path).toBe("a/photo.jpg");
    expect(await as(null, `select public.storage_object_is_public($1) as r`, ["a/photo.jpg"])).toBe(true);
  });

  it("обычный пользователь не вызывает функции администратора", async () => {
    await expect(save(ALICE, "ONA-1")).rejects.toThrow(/forbidden/);
    await expect(save(null, "ONA-1")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, `select public.admin_stats() as r`)).rejects.toThrow(/forbidden/);
    await expect(as(ALICE, `select public.admin_list_users() as r`)).rejects.toThrow(/forbidden/);
  });

  it("Admin не получает функции Super Admin", async () => {
    await expect(as(ADMIN, `select public.admin_list_audit() as r`)).rejects.toThrow(/forbidden/);
    await expect(as(ADMIN, `select public.admin_list_admins() as r`)).rejects.toThrow(/forbidden/);
    await expect(as(ADMIN, `select public.admin_set_admin('x@y.z', 'super_admin') as r`)).rejects.toThrow(/forbidden/);
    await expect(as(ADMIN, `select public.admin_export() as r`)).rejects.toThrow(/forbidden/);
    expect(await as(SUPER, `select public.admin_export() is not null as r`)).toBe(true);
  });

  it("почта без подтверждения не даёт прав администратора", async () => {
    await db.query(`update auth.users set email_confirmed_at = null where id = $1`, [ADMIN]);
    await expect(save(ADMIN, "ONA-1")).rejects.toThrow(/forbidden/);
  });

  it("последнего Super Admin нельзя снять", async () => {
    await expect(as(SUPER, `select public.admin_set_admin('super@example.com', null) as r`)).rejects.toThrow(/last_super_admin/);
    await expect(as(SUPER, `select public.admin_set_admin('super@example.com', 'admin') as r`)).rejects.toThrow(/last_super_admin/);
    await as(SUPER, `select public.admin_set_admin('NEW@example.com', 'super_admin') as r`);
    await as(SUPER, `select public.admin_set_admin('super@example.com', 'admin') as r`);
    expect((await db.query(`select role from admins where email = 'new@example.com'`)).rows).toEqual([{ role: "super_admin" }]);
  });
});

describe("бронирование", () => {
  it("второй пользователь не может забронировать занятое желание", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    const booking = await book(ALICE, id) as any;
    expect(booking.ward_id).toBe("ONA-1");
    await expect(book(BOB, id)).rejects.toThrow(/wish_unavailable/);
    await expect(book(ALICE, id)).rejects.toThrow(/wish_unavailable/);
    expect((await db.query(`select count(*)::int as n from bookings`)).rows).toEqual([{ n: 1 }]);
  });

  it("база сама не допускает двух живых броней на одно желание", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    await expect(db.query(`insert into bookings (wish_id, user_id) values ($1, $2)`, [id, BOB])).rejects.toThrow(/bookings_one_live_per_wish/);
  });

  it("аноним бронировать не может", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await expect(book(null, id)).rejects.toThrow(/permission denied/);
  });

  it("желание попадает в кабинет владельца и не видно другим", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    const mine = await as<any>(ALICE, `select public.my_bookings() as r`);
    expect(mine.bookings).toHaveLength(1);
    expect(mine.bookings[0].ward_id).toBe("ONA-1");
    expect((await as<any>(BOB, `select public.my_bookings() as r`)).bookings).toHaveLength(0);
    expect((await tree(ALICE)).bulbs[0].mine).toBe(true);
    expect((await tree(BOB)).bulbs[0].mine).toBe(false);
    expect(JSON.stringify(await tree())).not.toContain("alice@example.com");
  });

  it("счётчик разделяет брони и переданные подарки", async () => {
    const a = await save(ADMIN, "ONA-1");
    const b = await save(ADMIN, "ONA-2");
    await save(ADMIN, "ONA-3");
    await book(ALICE, a.id);
    await book(BOB, b.id);
    await as(ADMIN, `select public.admin_set_status($1::uuid, 'fulfilled') as r`, [b.id]);
    const { stats } = await tree();
    expect(stats).toMatchObject({ target: 150, total: 3, free: 1, booked: 1, fulfilled: 1, lit: 2, remaining: 148 });
  });

  it("счётчик не показывает больше 100%, если желаний больше цели", async () => {
    await setTree({ target_wishes: 2 });
    for (const ward of ["ONA-1", "ONA-2", "ONA-3"]) await book(ALICE, (await save(ADMIN, ward)).id);
    expect((await tree()).stats).toMatchObject({ target: 3, lit: 3, remaining: 0 });
  });

  it("срок брони истекает, и желание снова свободно", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    await db.query(`update bookings set expires_at = now() - interval '1 minute'`);
    expect((await tree()).bulbs[0].status).toBe("free");
    expect((await db.query(`select state from bookings`)).rows).toEqual([{ state: "expired" }]);
    await book(BOB, id);
    expect((await as<any>(ALICE, `select public.my_bookings() as r`)).bookings).toHaveLength(0);
    expect((await as<any>(BOB, `select public.my_bookings() as r`)).bookings).toHaveLength(1);
  });

  it("переданный подарок не истекает", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    await as(ADMIN, `select public.admin_set_status($1::uuid, 'fulfilled') as r`, [id]);
    await db.query(`update bookings set expires_at = now() - interval '1 minute'`);
    expect((await tree()).bulbs[0].status).toBe("fulfilled");
  });

  it("срок брони берётся из настроек", async () => {
    await setTree({ booking_hours: 24 });
    const { id } = await save(ADMIN, "ONA-1");
    const booking = await book(ALICE, id) as any;
    const hours = (new Date(booking.expires_at).getTime() - new Date(booking.booked_at).getTime()) / 3.6e6;
    expect(hours).toBeCloseTo(24);
    await setTree({ booking_hours: 0 });
    const second = await save(ADMIN, "ONA-2");
    expect((await book(ALICE, second.id) as any).expires_at).toBeNull();
  });

  it("пауза останавливает бронирование", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await setTree({ booking_paused: true });
    await expect(book(ALICE, id)).rejects.toThrow(/booking_paused/);
    expect((await tree()).paused).toBe(true);
  });

  it("лимит на пользователя соблюдается", async () => {
    await setTree({ max_bookings_per_user: 1 });
    const a = await save(ADMIN, "ONA-1");
    const b = await save(ADMIN, "ONA-2");
    await book(ALICE, a.id);
    await expect(book(ALICE, b.id)).rejects.toThrow(/booking_limit/);
    await book(BOB, b.id);
  });

  it("скрытое желание нельзя открыть или забронировать", async () => {
    const { id } = await save(ADMIN, "ONA-1", { hidden: true });
    expect((await tree()).bulbs).toHaveLength(0);
    await expect(as(null, `select public.get_wish($1::uuid) as r`, [id])).rejects.toThrow(/wish_not_found/);
    await expect(book(ALICE, id)).rejects.toThrow(/wish_unavailable/);
  });
});

describe("администрирование", () => {
  it("снятие брони требует причину и попадает в журнал", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    await expect(as(ADMIN, `select public.admin_set_status($1::uuid, 'free') as r`, [id])).rejects.toThrow(/reason_required/);
    await as(ADMIN, `select public.admin_set_status($1::uuid, 'free', 'Передумал') as r`, [id]);
    expect((await db.query(`select state, release_reason from bookings`)).rows).toEqual([{ state: "released", release_reason: "Передумал" }]);
    const log = (await db.query<any>(`select * from audit_log where action = 'wish.status_changed'`)).rows[0];
    expect(log.actor_email).toBe("admin@example.com");
    expect(log.details.reason).toBe("Передумал");
    await book(BOB, id);
  });

  it("бронь нельзя создать сменой статуса без пользователя", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await expect(as(ADMIN, `select public.admin_set_status($1::uuid, 'booked') as r`, [id])).rejects.toThrow(/booking_required/);
  });

  it("ID подопечного уникален", async () => {
    await save(ADMIN, "ONA-1");
    await expect(save(ADMIN, "ONA-1")).rejects.toThrow(/ward_id_taken/);
  });

  it("лампочки выдаются по порядку и освобождаются при удалении", async () => {
    const a = await save(ADMIN, "ONA-1");
    const b = await save(ADMIN, "ONA-2");
    expect([a.no, b.no]).toEqual([1, 2]);
    const deleted = await as<any>(ADMIN, `select public.admin_delete_wish($1::uuid) as r`, [a.id]);
    expect(deleted.paths).toEqual([]);
    expect((await save(ADMIN, "ONA-3")).no).toBe(1);
  });

  it("импорт либо проходит целиком, либо не меняет ничего", async () => {
    await save(ADMIN, "ONA-1");
    const rows = [
      { ward_id: "ONA-2", public_name: "Лола", age: 7, wish_title: "Кукла" },
      { ward_id: "ONA-1", public_name: "Дубль", age: 9, wish_title: "Мяч" },
    ];
    await expect(as(ADMIN, `select public.admin_import_wishes($1::jsonb) as r`, [JSON.stringify(rows)])).rejects.toThrow(/ward_id_taken/);
    expect((await tree()).bulbs).toHaveLength(1);

    rows[1].ward_id = "ONA-3";
    expect(await as(ADMIN, `select public.admin_import_wishes($1::jsonb) as r`, [JSON.stringify(rows)])).toEqual({ created: 2 });
    expect((await tree()).bulbs.map((b: any) => b.no)).toEqual([1, 2, 3]);
    expect(await as(ADMIN, `select public.admin_check_ward_ids($1::jsonb) as r`, [JSON.stringify(["ONA-3", "ONA-99"])])).toEqual(["ONA-3"]);
  });

  it("контакты редактируются и меняют порядок", async () => {
    const created = await as<any>(ADMIN, `select public.admin_save_contact($1::jsonb) as r`, [JSON.stringify({ slack_handle: "new.user", label: "Новый" })]);
    const content = await as<any>(null, `select public.get_public_content() as r`);
    expect(content.contacts.map((c: any) => c.slack_handle)).toEqual(["a.kupriianova", "a.savina", "u.zhukova", "new.user"]);

    const ids = [created.id, ...content.contacts.slice(0, 3).map((c: any) => c.id)];
    await as(ADMIN, `select public.admin_reorder_contacts($1::jsonb) as r`, [JSON.stringify(ids)]);
    await as(ADMIN, `select public.admin_delete_contact($1::uuid) as r`, [content.contacts[0].id]);
    const after = await as<any>(null, `select public.get_public_content() as r`);
    expect(after.contacts.map((c: any) => c.slack_handle)).toEqual(["new.user", "a.savina", "u.zhukova"]);
  });

  it("ссылка контакта может быть только https", async () => {
    const save = (url: string) => as(ADMIN, `select public.admin_save_contact($1::jsonb) as r`, [JSON.stringify({ slack_handle: "x", slack_url: url })]);
    await expect(save("javascript:alert(1)")).rejects.toThrow(/validation_failed/);
    await expect(save("https://example.slack.com/team/U1")).resolves.toBeTruthy();
    await expect(save("")).resolves.toBeTruthy();
  });

  it("настройки сохраняются только по разрешённым ключам", async () => {
    await as(ADMIN, `select public.admin_save_setting('about', $1::jsonb) as r`, [JSON.stringify({ title: "Новый", paragraphs: ["Текст"] })]);
    expect((await as<any>(null, `select public.get_public_content() as r`)).settings.about.title).toBe("Новый");
    await expect(as(ADMIN, `select public.admin_save_setting('secret', '{}'::jsonb) as r`)).rejects.toThrow(/validation_failed/);
  });

  it("список пользователей показывает их брони", async () => {
    const { id } = await save(ADMIN, "ONA-1");
    await book(ALICE, id);
    await as(ALICE, `select public.save_my_profile('Алиса', 'alice', '') as r`);
    const users = await as<any[]>(ADMIN, `select public.admin_list_users() as r`);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: "alice@example.com", display_name: "Алиса", slack: "alice", count: 1 });
    expect(users[0].wishes[0].ward_id).toBe("ONA-1");
  });

  it("счётчик изменений растёт при каждой правке", async () => {
    const version = async () => (await as<any>(null, `select version as r from public.site_pulse`));
    const before = Number(await version());
    await save(ADMIN, "ONA-1");
    expect(Number(await version())).toBeGreaterThan(before);
  });
});
