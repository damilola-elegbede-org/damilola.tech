import { LoginForm } from '@/components/admin/LoginForm';
import { generateCsrfToken } from '@/lib/csrf';

export default async function LoginPage() {
  const csrfToken = await generateCsrfToken();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-md p-8">
        <h1 className="mb-8 text-center text-2xl font-bold text-[var(--color-text)]">
          Admin Login
        </h1>
        <LoginForm csrfToken={csrfToken} />
      </div>
    </div>
  );
}
