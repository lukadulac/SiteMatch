import RegisterForm from "@/components/auth/register/RegisterForm";

export default async function RegisterPage() {
  return (
    <section>
      <h1 className="text-4xl text-center font-semibold">
        Join Work
        <span className="bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Bridge
        </span>
      </h1>
      <p className="text-center mb-4 mt-2">Create your account and get started.</p>
      <section>
        <RegisterForm />
      </section>
    </section>
  );
}
