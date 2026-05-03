import { driver } from "driver.js";
import { queryVisibleTourTarget } from "./tourTargets";

const FIRST_CARD_SEL = '[data-tour="first-card"]';

/** Tour único no dashboard (primeiro cartão). Chamar com DOM já montado na rota `/`. */
export function runDashboardOnboardingTour(onDestroyed: () => void): void {
  const d = driver({
    animate: true,
    overlayColor: "#001430",
    overlayOpacity: 0.72,
    smoothScroll: true,
    allowClose: true,
    popoverClass: "driver-popover-paytrackr",
    nextBtnText: "Próximo",
    prevBtnText: "Voltar",
    doneBtnText: "Concluir",
    showButtons: ["next", "previous", "close"],
    steps: [
      {
        element: () => queryVisibleTourTarget(FIRST_CARD_SEL) as Element,
        popover: {
          title: "Gestão de cartões",
          description:
            "Aqui você inclui seu primeiro cartão para acompanhar fatura, vencimento e limite disponível.",
          side: "bottom",
          align: "center",
        },
      },
    ],
    onDestroyed: () => {
      onDestroyed();
    },
  });

  d.drive();
}
