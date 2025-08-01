import { GoogleAuth } from "@/components/auth/google-auth";

export default function AuthPage() {
	return (
		<div className="min-h-svh flex items-center justify-center p-4">
			<GoogleAuth />
		</div>
	);
}