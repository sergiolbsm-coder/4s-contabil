export type Papel = "admin" | "contador" | "atendimento" | "parceiro" | "cliente";

// Quem enxerga e edita a carteira de clientes (parceiro e cliente não)
const EQUIPE: Papel[] = ["admin", "contador", "atendimento"];

export const podeVerClientes = (p: Papel) => EQUIPE.includes(p);
export const podeEditarClientes = (p: Papel) => p === "admin" || p === "contador";
