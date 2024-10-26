import { verifyAuthToken } from "@/lib/auth-token";
import { redirect } from "next/navigation";
import Client from "./client";

export default async function Page(props: { params: { userId: string } }) {
  const session = await verifyAuthToken();

  if (!session) return redirect("/auth/login");

  return (
    <>
      <div>
        <p>Room Chat ke {props.params.userId}</p>
        <p>yang login {session.id}</p>

        <Client
          authenticatedUser={{ id: session.id }}
          toUser={{ id: props.params.userId }}
        />
      </div>
    </>
  );
}
