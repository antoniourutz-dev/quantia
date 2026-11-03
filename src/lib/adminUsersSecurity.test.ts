// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

// Execute the actual Edge handler with an in-memory Auth/Data API boundary.
// No production credentials, accounts or learning data are used.
const source = readFileSync('supabase/functions/admin-users/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function harness(actor = 'manager', banned = false, invalid = false) {
  const updateUserById = vi.fn(async () => ({ error: null }));
  const createUser = vi.fn(async () => ({ data: {}, error: new Error('User already registered') }));
  const rpc = vi.fn(async () => ({ error: null }));
  const tables: Record<string, Record<string, string>[]> = {
    admin_users: [{ user_id: 'owner' }],
    user_roles: [{ user_id: 'owner', role: 'admin' }],
    quantia_admin_permissions: [{ user_id: 'manager', permission: 'users.manage' }, { user_id: 'other-manager', permission: 'questions.manage' }],
  };
  const from = (name: string) => {
    let rows = tables[name] ?? [];
    const query = {
      select: () => query, limit: () => query,
      eq: (key: string, value: string) => { rows = rows.filter(row => row[key] === value); return query; },
      in: () => query, order: () => query,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  };
  const service = { from, schema: () => ({ from }), rpc, auth: { admin: {
    getUserById: vi.fn(async () => ({ data: { user: { id: actor, banned_until: banned ? '2999-01-01' : null } }, error: null })),
    updateUserById, createUser,
    listUsers: vi.fn(async () => ({ data: { total: 4, users: ['owner','manager','other-manager','learner'].map(id => ({id,email:`${id}@example.test`})) }, error:null })),
  } } };
  let handler: (req: Request) => Promise<Response>;
  runInNewContext(compiled, {
    Request, Response, URL, console: { error: vi.fn() },
    createClient: () => service, createRemoteJWKSet: () => ({}),
    jwtVerify: async () => { if (invalid) throw new Error('bad signature'); return { payload: {sub: actor} }; },
    buildCorsHeaders: () => ({}), corsPreflightResponse: () => null,
    Deno: { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'test' }, serve: (fn: typeof handler) => {handler=fn;} },
  });
  return { updateUserById, createUser, rpc,
    call: (body: Record<string,unknown>, auth=true) => handler(new Request('https://example.test/admin-users', {method:'POST', headers: auth ? {authorization:'Bearer test'} : {}, body:JSON.stringify(body)})) };
}
describe('admin-users authorization', () => {
  it('rejects anonymous requests', async () => expect((await harness().call({action:'list'},false)).status).toBe(401));
  it('rejects an invalid token', async () => expect((await harness('manager',false,true).call({action:'list'})).status).toBe(401));
  it('rejects banned users', async () => expect((await harness('manager',true).call({action:'list'})).status).toBe(401));
  it('rejects ordinary learners', async () => expect((await harness('learner').call({action:'list'})).status).toBe(403));
  it.each(['owner','manager','other-manager'])('protects privileged target %s', async userId => {
    const h=harness(); expect((await h.call({action:'disable',userId})).status).toBe(403); expect(h.updateUserById).not.toHaveBeenCalled();
  });
  it.each(['delete','reset_progress','set_password'])('denies delegated %s', async action => {
    const h=harness(); expect((await h.call({action,userId:'learner',password:'test'})).status).toBe(403); expect(h.updateUserById).not.toHaveBeenCalled();
  });
  it('blocks email-only takeover of an existing account', async () => {
    const h=harness(); expect((await h.call({action:'create_restricted_question_bank_viewer',email:'owner@example.test',password:'test'})).status).toBe(403); expect(h.updateUserById).not.toHaveBeenCalled();
  });
  it('lists learners without privileged identities', async () => {
    const response=await harness().call({action:'list'}); expect(response.status).toBe(200);
    const body=await response.json(); expect(body.items.map((u:{userId:string}) => u.userId)).toEqual(['learner']);
  });
  it('allows delegated management of a learner', async () => {
    const h=harness(); expect((await h.call({action:'disable',userId:'learner'})).status).toBe(200); expect(h.updateUserById).toHaveBeenCalledWith('learner',{ban_duration:'876000h'});
  });
  it('retains owner credential management', async () => {
    const h=harness('owner'); expect((await h.call({action:'set_password',userId:'learner',password:'test'})).status).toBe(200); expect(h.updateUserById).toHaveBeenCalledWith('learner',{password:'test'});
  });
});
