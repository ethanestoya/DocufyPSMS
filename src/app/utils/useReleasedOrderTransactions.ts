import { useEffect, useState } from 'react';
import { showDbError } from '../../lib/db/errors';
import {
  fetchReleasedOrderTransactions,
  subscribeReleasedOrderTransactions,
} from '../../lib/db/releasedOrderTransactionsRepo';
import type { ReleasedOrderTransactionDto } from '../../lib/db/types';

export function useReleasedOrderTransactions(): ReleasedOrderTransactionDto[] {
  const [transactions, setTransactions] = useState<ReleasedOrderTransactionDto[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await fetchReleasedOrderTransactions();
        if (active) setTransactions(rows);
      } catch (error) {
        if (active) showDbError('load released order history', error);
      }
    };

    void refresh();
    const unsubscribe = subscribeReleasedOrderTransactions(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return transactions;
}
