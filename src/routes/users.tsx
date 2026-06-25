import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Usuarios — EvalPro" }] }),
  component: UsersRedirect,
});

function UsersRedirect() {
  const navigate = useNavigate();
  useEffect(() => { navigate({ to: "/config" }); }, [navigate]);
  return null;
}
