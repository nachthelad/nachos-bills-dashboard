import { SettingsForm } from "@/components/settings/settings-form"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Sistema</p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Configuración
          </h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Administrá tus preferencias, apariencia y configuración de cuenta.
        </p>
      </div>

      <div className="max-w-2xl">
        <SettingsForm />
      </div>
    </div>
  )
}
