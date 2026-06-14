import { AuthPageShell } from "../features/auth/AuthPageShell";
import { SignupForm } from "../features/auth/SignupForm"; // Update this path to where you saved the file above

export default function SignupPage() {
  return (
    <AuthPageShell 
      title="Join the Club." 
      subtitle="Say goodbye to your free time. Create an account to start suffering... I mean, studying." 
      mode="signup"
    >
      <SignupForm />
    </AuthPageShell>
  );
}