import { TransactionModal } from "@/components/TransactionModal";
import { useUI } from "@/lib/ui-store";

/**
 * Mount once at the app shell. Lets any component (palette, quick actions,
 * keyboard shortcut) open the transaction modal without prop-drilling.
 */
export function GlobalTransactionModal() {
  const open = useUI((s) => s.txModalOpen);
  const defaults = useUI((s) => s.txDefaults);
  const edit = useUI((s) => s.txEdit);
  const close = useUI((s) => s.closeTxModal);

  return (
    <TransactionModal
      open={open}
      onClose={close}
      defaultType={defaults?.type ?? "deposit"}
      defaultAccountId={defaults?.accountId}
      edit={edit}
    />
  );
}
