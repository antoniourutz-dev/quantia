import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MobileTopBar from './MobileTopBar';

describe('selector de oposici�n en m�vil', () => {
  it('muestra nombres completos, busca y permite elegir o gestionar las oposiciones', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const manage = vi.fn();
    render(<MobileTopBar title="Test" subtitle="Electromedicina" dotClass="" curriculumId="electro"
      curriculumOptions={[{ id: 'electro', label: 'Electromedicina' }, { id: 'admin', label: 'T�cnico/a Medio Administraci�n y Gesti�n' }]}
      curriculumOptionsLoading={false} onSelectCurriculum={select} onManageCurriculums={manage} onLogout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Cambiar oposici/i }));
    expect(screen.getByText('T�cnico/a Medio Administraci�n y Gesti�n')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Buscar...'), 'Administraci�n');
    await user.click(screen.getByRole('button', { name: /T�cnico\/a Medio Administraci�n y Gesti�n/ }));
    expect(select).toHaveBeenCalledWith('admin');

    await user.click(screen.getByRole('button', { name: /Cambiar oposici/i }));
    await user.click(screen.getByRole('button', { name: /Gestionar oposiciones visibles/i }));
    expect(manage).toHaveBeenCalledOnce();
  });
});

