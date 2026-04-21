"use client"

import { useAuth } from "@/lib/auth-context"
import { useTheme } from "next-themes"
import { useAmountVisibility } from "@/components/amount-visibility"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LogOut, Moon, Sun, Laptop } from "lucide-react"

export function SettingsForm() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { showAmounts, toggle } = useAmountVisibility()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>
            Personalizá cómo se ve TOLVA en tu dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tema</Label>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Próximamente</span>
            </div>
            <div className="grid grid-cols-3 gap-4 opacity-50">
              <Button
                variant="outline"
                disabled
                className="justify-start gap-2"
              >
                <Sun className="h-4 w-4" />
                Claro
              </Button>
              <Button
                variant="outline"
                disabled
                className="justify-start gap-2"
              >
                <Moon className="h-4 w-4" />
                Oscuro
              </Button>
              <Button
                variant="outline"
                disabled
                className="justify-start gap-2"
              >
                <Laptop className="h-4 w-4" />
                Sistema
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La personalización de tema estará disponible en una actualización futura.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacidad</CardTitle>
          <CardDescription>
            Administrá cómo se muestran tus datos financieros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Mostrar montos por defecto</Label>
              <p className="text-sm text-muted-foreground">
                Si está desactivado, los montos se ocultarán (****) hasta que los mostrés manualmente.
              </p>
            </div>
            <Switch
              checked={showAmounts}
              onCheckedChange={toggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>
            Administrá tu cuenta y sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Correo electrónico</Label>
            <div className="flex h-10 w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {user?.email}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            className="w-full sm:w-auto gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
