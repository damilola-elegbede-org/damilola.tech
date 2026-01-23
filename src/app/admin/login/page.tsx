import { LoginForm } from '@/components/admin/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-md p-8">
        <h1 className="mb-8 text-center text-2xl font-bold text-[var(--color-text)]">
          Admin Login
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
