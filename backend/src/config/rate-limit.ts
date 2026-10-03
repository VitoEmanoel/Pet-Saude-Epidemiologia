import { BlockList, isIP } from "node:net";
import { rateLimit } from "express-rate-limit";
import { sendError } from "../utils/api-response";

const DEFAULT_REQUESTS_PER_MINUTE = 600;

// Endereços que nunca vêm direto da internet: a própria máquina, a rede do Docker e redes internas.
const privateNetworks = new BlockList();
privateNetworks.addSubnet("127.0.0.0", 8, "ipv4");
privateNetworks.addSubnet("10.0.0.0", 8, "ipv4");
privateNetworks.addSubnet("172.16.0.0", 12, "ipv4");
privateNetworks.addSubnet("192.168.0.0", 16, "ipv4");
privateNetworks.addSubnet("169.254.0.0", 16, "ipv4");
privateNetworks.addAddress("::1", "ipv6");
privateNetworks.addSubnet("fc00::", 7, "ipv6");
privateNetworks.addSubnet("fe80::", 10, "ipv6");

export function isPrivateAddress(ip: string | undefined) {
  if (!ip) {
    return false;
  }

  const address = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
  const family = isIP(address);

  return family !== 0 && privateNetworks.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Requisições por minuto por IP (RATE_LIMIT_PER_MINUTE; 0 desliga). */
export function getRateLimitPerMinute() {
  const configured = Number(process.env.RATE_LIMIT_PER_MINUTE ?? DEFAULT_REQUESTS_PER_MINUTE);

  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : DEFAULT_REQUESTS_PER_MINUTE;
}

/**
 * Limite de requisições por IP real do visitante (S17). Endereços privados ficam de fora:
 * uso local, testes e, sem TRUST_PROXY, o próprio proxy (que representaria todos os visitantes;
 * limitá-lo derrubaria o site para todos). Por isso, atrás de proxy, TRUST_PROXY é obrigatório.
 */
export function createApiRateLimiter() {
  const limit = getRateLimitPerMinute();

  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (request) => limit === 0 || isPrivateAddress(request.ip),
    handler: (_request, response) =>
      sendError(
        response,
        429,
        "rate_limited",
        "Muitas requisições em pouco tempo. Aguarde um minuto e tente novamente."
      )
  });
}
