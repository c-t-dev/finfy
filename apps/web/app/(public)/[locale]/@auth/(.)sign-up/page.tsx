import { AuthPage } from "@/components/auth-page";

export { generateMetadata } from "../../sign-up/page";

export default function Page(props: PageProps<"/[locale]/sign-up">) {
  return <AuthPage {...props} mode="signUp" overlay />;
}
