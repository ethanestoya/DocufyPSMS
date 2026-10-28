import React from "react";
import PrintTransaction from "./PrintTransaction";

interface UnifiedWalkInTransactionsProps {
  userRole: "admin" | "staff";
}

export default function UnifiedWalkInTransactions({ userRole }: UnifiedWalkInTransactionsProps) {
  return <PrintTransaction mode="walkin" userRole={userRole} />;
}
