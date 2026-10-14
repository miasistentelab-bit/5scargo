import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bienvenido");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-white shadow-glow flex items-center justify-center mb-4 overflow-hidden p-2">
            <img 
              src="https://general.premioseikon.com/wp-content/uploads/2021/10/Logo-CMQ-png.png" 
              alt="Quilmes Logo" 
              className="w-full h-full object-contain" 
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            5S CD-CORDOBA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Verificación mensual</p>
        </div>

        <Card className="p-6 shadow-elevated bg-gradient-surface border-border/50">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@empresa.com" />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} variant="hero" className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ingresar
            </Button>
          </form>
        </Card>

        <div className="mt-4 space-y-4">
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/resultados")}>
            Ver resultados (sin iniciar sesión)
          </Button>
          
          <div className="flex justify-center pt-4 border-t border-border/30">
            <div className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity">
              <img 
                src="https://ii.ct-stc.com/5/logos/empresas/2017/12/19/cargo-servicios-industriales-sa-42A9CB5EF1E0C4FE161830thumbnail.png" 
                alt="Cargo Logo" 
                className="h-full w-auto object-contain" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
