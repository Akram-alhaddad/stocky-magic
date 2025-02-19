
import { useQuery } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

export default function Index() {
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll("items");
    }
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: async () => {
      const db = await getDB();
      const allTransactions = await db.getAll("transactions");
      return allTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    }
  });

  const lowStockItems = items.filter(
    (item) => item.quantity <= item.minQuantity
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 font-arabic">
        لوحة التحكم
      </h1>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card className="p-4">
          <h3 className="font-arabic text-lg mb-2">إجمالي الأصناف</h3>
          <p className="text-3xl font-bold">
            {items.length}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-arabic text-lg mb-2">الأصناف منخفضة المخزون</h3>
          <p className="text-3xl font-bold text-red-500">
            {lowStockItems.length}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-arabic text-lg mb-2">المعاملات الأخيرة</h3>
          <p className="text-3xl font-bold">
            {transactions.length}
          </p>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-500 mb-4">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-arabic font-medium">
              تنبيه: أصناف منخفضة المخزون
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-arabic">الصنف</TableHead>
                <TableHead className="font-arabic">الكمية الحالية</TableHead>
                <TableHead className="font-arabic">الحد الأدنى</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium font-arabic">
                    {item.nameAr}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.minQuantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-arabic text-lg mb-4">آخر المعاملات</h3>
        <Table>
          <TableCaption className="font-arabic">
            سجل آخر 5 معاملات
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="font-arabic">التاريخ</TableHead>
              <TableHead className="font-arabic">القسم</TableHead>
              <TableHead className="font-arabic">النوع</TableHead>
              <TableHead className="font-arabic">الأصناف</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {new Date(transaction.date).toLocaleDateString("ar")}
                </TableCell>
                <TableCell className="font-arabic">
                  {transaction.department}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={transaction.type === "in" ? "default" : "secondary"}
                    className="font-arabic"
                  >
                    {transaction.type === "in" ? "وارد" : "صادر"}
                  </Badge>
                </TableCell>
                <TableCell className="font-arabic">
                  {transaction.items?.length || 0} صنف
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
