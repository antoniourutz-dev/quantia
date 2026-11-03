import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import AdminDashboard from './AdminDashboard';
const api = vi.hoisted(() => ({ rpc: vi.fn(async () => ({data:12,error:null})), from: vi.fn() }));
vi.mock('../../lib/locale', () => ({useAppLocale: () => 'es'}));
vi.mock('../../lib/supabaseClient', () => ({supabase:{rpc:api.rpc,from:api.from,schema:()=>({from:api.from})}}));
const props = {curriculumOptions:[],defaultCurriculum:'',onOpenStudents:vi.fn(),onOpenQuestions:vi.fn(),onOpenCatalogs:vi.fn(),onOpenQuality:vi.fn()};
afterEach(() => {cleanup();vi.clearAllMocks();});
describe('administrative section permissions', () => {
 it('defaults to no administrative actions or statistics', () => {
  render(<AdminDashboard {...props}/>);
  for(const name of ['Alumnos','Preguntas','Catálogos','Calidad']) expect(screen.queryByRole('button',{name})).toBeNull();
  expect(api.rpc).not.toHaveBeenCalled();expect(api.from).not.toHaveBeenCalled();
 });
 it('shows all five sections when explicitly granted', async () => {
  const query={select:()=>query,eq:()=>query,gte:()=>query,then:(resolve:(result:unknown)=>unknown)=>Promise.resolve({count:4,error:null}).then(resolve)};
  api.from.mockReturnValue(query);
  render(<AdminDashboard {...props} canManageQuestions canManageCatalogs canManageUsers canReadStatistics canManageQuality/>);
  for(const name of ['Alumnos','Preguntas','Catálogos','Calidad']) expect(screen.getByRole('button',{name})).toBeInTheDocument();
  expect(screen.getByText('Sesiones iniciadas')).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByText('12')).toBeInTheDocument());
  expect(api.rpc).toHaveBeenCalledWith('quantia_user_count');
 });
 it('allows catalogs without exposing unrelated actions', () => {
  render(<AdminDashboard {...props} canManageCatalogs/>);
  expect(screen.getByRole('button',{name:'Catálogos'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Alumnos'})).toBeNull();
  expect(api.rpc).not.toHaveBeenCalled();
 });
});
