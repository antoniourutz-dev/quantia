import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MobileTopBar from './MobileTopBar';

describe('selector de oposición en móvil', () => {
  it('muestra nombres completos, busca y permite elegir o gestionar las oposiciones', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const manage = vi.fn();
    render(<MobileTopBar title="Test" subtitle="Electromedicina" dotClass="" curriculumId="electro"
      curriculumOptions={[{ id: 'electro', label: 'Electromedicina' }, { id: 'admin', label: 'Técnico/a Medio Administración y Gestión' }]}
      curriculumOptionsLoading={false} onSelectCurriculum={select} onManageCurriculums={manage} onLogout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Cambiar oposici/i }));
    expect(screen.getByText('Técnico/a Medio Administración y Gestión')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Buscar...'), 'Administración');
    await user.click(screen.getByRole('button', { name: /Técnico\/a Medio Administración y Gestión/ }));
    expect(select).toHaveBeenCalledWith('admin');

    await user.click(screen.getByRole('button', { name: /Cambiar oposici/i }));
    await user.click(screen.getByRole('button', { name: /Gestionar oposiciones visibles/i }));
    expect(manage).toHaveBeenCalledOnce();
  });
});
