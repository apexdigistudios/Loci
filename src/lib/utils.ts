export { cn } from "cn"

export function cleanPhone(phone: string): string {
	return phone.replace(/\D/g, "").slice(-9);
}
