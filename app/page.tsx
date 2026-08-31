import { redirect } from "next/navigation";

/**
 * There is no public or marketing homepage (docs/PRODUCT_SPEC.md §2, §12).
 * The app opens directly to sign-in.
 */
export default function RootPage() {
  redirect("/login");
}
