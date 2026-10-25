import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";

export default async function Home() {
  const u = await exigirUsuario();
  redirect(u.trocarSenha ? "/trocar-senha" : homePara(u.papel));
}
