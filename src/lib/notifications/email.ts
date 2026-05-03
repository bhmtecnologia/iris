import { Resend } from "resend";
import { STUB_RESEND } from "../dev-stubs";

const resend = STUB_RESEND ? null : new Resend(process.env.RESEND_API_KEY);

export async function sendDownloadEmail(params: {
  to: string;
  eventName: string;
  downloadLinks: string[];
}) {
  if (STUB_RESEND) {
    console.log("[stub:email] →", params.to, params.eventName, params.downloadLinks);
    return { id: "stub-email" };
  }

  const links = params.downloadLinks
    .map((url, i) => `<li><a href="${url}">Foto ${i + 1}</a></li>`)
    .join("");

  return resend!.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Iris <noreply@iris.app>",
    to: params.to,
    subject: `Suas fotos de ${params.eventName} estão prontas`,
    html: `
      <h2>Pagamento confirmado!</h2>
      <p>Seus downloads em alta resolução (válidos por 7 dias):</p>
      <ul>${links}</ul>
    `,
  });
}
