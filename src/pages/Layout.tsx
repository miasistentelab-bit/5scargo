import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, ImageIcon, Trash2, MapIcon, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Layout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Eliminamos el useEffect que redirigía a /auth si no había usuario, 
  // ya que queremos permitir la visualización pública.

  const loadLayout = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracion")
        .select("valor")
        .eq("clave", "master_plan_url")
        .maybeSingle();
      
      if (error) {
        console.error("Error loading layout:", error);
        return;
      }
      
      if (data) {
        setUrl(data.valor);
      }
    } catch (err) {
      console.error("Failed to fetch configuration table.", err);
    }
  };

  useEffect(() => {
    loadLayout();
  }, []);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      // Usamos el ID del usuario en el path para cumplir con las políticas de RLS típicas de Supabase
      const path = `${user.id}/config/master_plan_${Date.now()}.${ext}`;
      
      console.log("Subiendo archivo a:", path);
      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error("Error de Storage:", uploadError);
        throw new Error(`Error al subir la imagen: ${uploadError.message}`);
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from("evidencias")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years

      if (signedError || !signed) {
        console.error("Error al crear URL firmada:", signedError);
        throw new Error("No se pudo generar el enlace a la imagen");
      }

      console.log("Imagen subida, guardando en base de datos...");
      const { error: upsertError } = await supabase
        .from("configuracion")
        .upsert({ clave: "master_plan_url", valor: signed.signedUrl }, { onConflict: "clave" });

      if (upsertError) {
        console.error("Error de Base de Datos:", upsertError);
        throw new Error(`Error al guardar la configuración: ${upsertError.message}. ¿Ejecutaste la migración SQL?`);
      }

      setUrl(signed.signedUrl);
      toast.success("Layout actualizado correctamente");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al cargar el Layout";
      console.error("handleUpload error:", error);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("configuracion")
        .upsert({ clave: "master_plan_url", valor: null }, { onConflict: "clave" });

      if (error) throw error;
      setUrl(null);
      toast.success("Layout eliminado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al eliminar";
      toast.error(message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Instalaciones</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Layout del Predio
        </h1>
        <p className="text-muted-foreground mt-2">Cargá una foto del plano general o layout de la planta para referencia en los resultados.</p>
      </header>

      <Card className="p-8 bg-gradient-surface border-border/50 shadow-card flex flex-col items-center justify-center min-h-[400px]">
        {url ? (
          <div className="relative w-full max-w-2xl group">
            <img src={url} alt="Layout" className="w-full h-auto rounded-lg shadow-lg border border-border/50" />
            {user && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} 
                />
                <Button 
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-5 w-5" />
                </Button>
                <Button 
                  size="icon"
                  variant="destructive"
                  className="rounded-full shadow-md"
                  onClick={handleDelete}
                  disabled={uploading}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <MapIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">No hay un Layout cargado</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {user 
                  ? "Subí una imagen para que esté disponible en la sección de resultados."
                  : "El administrador aún no ha cargado un layout."}
              </p>
            </div>
            
            {user && (
              <>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} 
                />
                
                <Button 
                  variant="hero" 
                  size="lg"
                  disabled={uploading} 
                  className="gap-2 min-w-[200px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  {uploading ? "Subiendo..." : "Seleccionar Imagen"}
                </Button>
                
                <p className="text-xs text-muted-foreground">Formatos soportados: JPG, PNG, WEBP</p>
              </>
            )}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
