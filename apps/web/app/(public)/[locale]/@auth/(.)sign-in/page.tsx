import { AuthPage } from "@/components/auth-page";

export { generateMetadata } from "../../sign-in/page";

export default function Page(props: PageProps<"/[locale]/sign-in">) {
  return <AuthPage {...props} mode="signIn" overlay />;
}
