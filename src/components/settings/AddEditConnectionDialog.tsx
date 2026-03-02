import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import type { Database } from "@/integrations/supabase/types";

type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];

const schema = z.object({
  empresa: z.string().min(1, "Empresa é obrigatória"),
  phone_number_id: z.string().min(1, "Phone Number ID é obrigatório"),
  business_account_id: z.string().min(1, "WABA ID é obrigatório"),
  label: z.string().optional(),
  display_phone: z.string().optional(),
  verified_name: z.string().optional(),
  is_default: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection?: WhatsAppConnection | null;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
}

export function AddEditConnectionDialog({
  open,
  onOpenChange,
  connection,
  onSubmit,
  isPending,
}: Props) {
  const { empresaRecords } = useCompany();
  const isEdit = !!connection;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      empresa: "",
      phone_number_id: "",
      business_account_id: "",
      label: "",
      display_phone: "",
      verified_name: "",
      is_default: false,
    },
  });

  useEffect(() => {
    if (open && connection) {
      form.reset({
        empresa: connection.empresa as string,
        phone_number_id: connection.phone_number_id,
        business_account_id: connection.business_account_id,
        label: connection.label || "",
        display_phone: connection.display_phone || "",
        verified_name: connection.verified_name || "",
        is_default: connection.is_default || false,
      });
    } else if (open && !connection) {
      form.reset({
        empresa: "",
        phone_number_id: "",
        business_account_id: "",
        label: "",
        display_phone: "",
        verified_name: "",
        is_default: false,
      });
    }
  }, [open, connection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Conexão" : "Adicionar Número WhatsApp"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="empresa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {empresaRecords
                        .filter((e) => e.is_active)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_number_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 123456789012345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WABA ID (Business Account)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 987654321098765" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Comercial, Suporte" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (exibição)</FormLabel>
                  <FormControl>
                    <Input placeholder="+55 11 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="verified_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Verificado</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome verificado na Meta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Definir como padrão</Label>
              <Switch
                checked={form.watch("is_default")}
                onCheckedChange={(v) => form.setValue("is_default", v)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isEdit ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
