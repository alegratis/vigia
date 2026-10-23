'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { runEvaluation } from '@/lib/alertas/run'
import { isTwilioConfigured } from '@/lib/alertas/twilio'
import { isAlertMode, setAlertMode } from '@/lib/admin/settings'
import {
  createAdminSession,
  destroyAdminSession,
  isAdminConfigured,
  isAdminSession,
  passwordMatches,
} from '@/lib/admin/session'

export interface ActionResult {
  ok: boolean
  message: string
}

export interface LoginState {
  error: string | null
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAdminConfigured()) return { error: 'El panel no está configurado: falta ADMIN_PASSWORD.' }

  const password = String(formData.get('password') ?? '')
  if (!passwordMatches(password)) {
    // La pausa encarece cada intento de adivinar la contraseña.
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { error: 'Contraseña incorrecta.' }
  }

  await createAdminSession()
  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  await destroyAdminSession()
  redirect('/admin/login')
}

export async function setAlertModeAction(mode: string): Promise<ActionResult> {
  if (!(await isAdminSession())) return { ok: false, message: 'Sesión vencida. Vuelve a iniciar sesión.' }
  if (!isAlertMode(mode)) return { ok: false, message: 'Modo no válido.' }
  if (mode === 'live' && !isTwilioConfigured()) {
    return { ok: false, message: 'No se puede activar el modo en vivo: faltan las variables de Twilio.' }
  }

  try {
    await setAlertMode(mode)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }
  }
  revalidatePath('/admin')
  return { ok: true, message: 'Cambio guardado. Se aplica desde el siguiente ciclo.' }
}

export async function runCycleAction(): Promise<ActionResult> {
  if (!(await isAdminSession())) return { ok: false, message: 'Sesión vencida. Vuelve a iniciar sesión.' }

  try {
    const summary = await runEvaluation()
    revalidatePath('/admin')
    if (summary.status === 'skipped_off') return { ok: true, message: 'Las alertas están apagadas: no se evaluó nada.' }
    if (summary.status === 'skipped_locked') return { ok: true, message: 'Ya hay un ciclo en curso. Intenta en unos minutos.' }
    if (summary.status === 'error') return { ok: false, message: summary.errors[0] ?? 'El ciclo terminó con error.' }
    return {
      ok: true,
      message: `Ciclo listo: ${summary.unitsEvaluated} unidades evaluadas, ${summary.eventsCreated} eventos nuevos, ${summary.sends} SMS enviados.`,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'El ciclo falló.' }
  }
}
