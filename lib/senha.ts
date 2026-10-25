import { randomInt } from "node:crypto";

// Sem caracteres ambíguos (0/O, 1/l/I) para ditar por WhatsApp ou telefone
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarSenhaTemporaria(tamanho = 10) {
  return Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}
