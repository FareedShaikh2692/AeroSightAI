import { api } from "@/lib/api";
import { permissionsForUi } from "@/lib/policy";
export const GET = api(async (ctx) => permissionsForUi(ctx));
