import { Check, CheckCheck, AlertCircle } from "lucide-react";

export const getConversationTick = (
    direction?: "inbound" | "outbound",
    status?: "sent" | "delivered" | "read" | "failed" | "received"
) => {
    if (direction !== "outbound") return null;

    const iconClass = "w-4 h-4 flex-shrink-0";

    switch (status) {
        case "sent":
            return <Check className={`${iconClass} text-muted-foreground`} />;
        case "delivered":
            return <CheckCheck className={`${iconClass} text-muted-foreground`} />;
        case "read":
            return <CheckCheck className={`${iconClass} text-blue-500`} />;
        case "failed":
            return <AlertCircle className={`${iconClass} text-destructive`} />;
        default:
            return null;
    }
};
