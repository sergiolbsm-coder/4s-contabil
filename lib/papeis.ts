export type Papel = "admin" | "contador" | "atendimento" | "parceiro" | "cliente";

// Quem enxerga e edita a carteira de clientes (parceiro e cliente não)
const EQUIPE: Papel[] = ["admin", "contador", "atendimento"];

export const podeVerClientes = (p: Papel) => EQUIPE.includes(p);
export const podeEditarClientes = (p: Papel) => p === "admin" || p === "contador";
export const ehAdmin = (p: Papel) => p === "admin";

export const ROTULOS_PAPEL: Record<Papel, string> = {
  admin: "Administrador", contador: "Contador", atendimento: "Atendimento", parceiro: "Parceiro", cliente: "Cliente",
};

// Tela inicial de cada papel (também o destino de quem tenta abrir página sem permissão)
export const homePara = (p: Papel) => (p === "cliente" ? "/portal" : p === "parceiro" ? "/sem-acesso" : "/clientes");
