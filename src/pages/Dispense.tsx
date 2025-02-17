
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

export default function Dispense() {
  const [language, setLanguage] = useState<"en" | "ar">("ar");
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [department, setDepartment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll("items");
    }
  });

  const dispenseItemMutation = useMutation({
    mutationFn: async ({ itemId, quantity, department }: { itemId: string; quantity: number; department: string }) => {
      const db = await getDB();
      const item = await db.get("items", itemId);
      
      if (!item) throw new Error("Item not found");
      if (item.quantity < quantity) throw new Error("Insufficient quantity");
      
      // Update item quantity
      await db.put("items", {
        ...item,
        quantity: item.quantity - quantity,
        lastUpdated: new Date()
      });
      
      // Add transaction
      const transactionId = crypto.randomUUID();
      await db.add("transactions", {
        id: transactionId,
        itemId,
        quantity,
        type: "out",
        department,
        date: new Date()
      });
      
      return { item, transactionId };
    },
    onSuccess: ({ item, transactionId }) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      generatePDF(item, quantity, department, transactionId);
      toast({
        title: language === "ar" ? "تم بنجاح" : "Success",
        description: language === "ar"
          ? "تم صرف المخزون بنجاح"
          : "Item dispensed successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const generatePDF = (item: any, quantity: number, department: string, transactionId: string) => {
    const doc = new jsPDF();
    
    // Add header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(language === "ar" ? "فاتورة صرف مخزون" : "Inventory Dispense Receipt", 105, 20, { align: "center" });
    
    // Add content
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    const content = [
      [`${language === "ar" ? "رقم المعاملة" : "Transaction ID"}: ${transactionId}`],
      [`${language === "ar" ? "التاريخ" : "Date"}: ${new Date().toLocaleDateString()}`],
      [`${language === "ar" ? "اسم الصنف" : "Item Name"}: ${language === "ar" ? item.nameAr : item.name}`],
      [`${language === "ar" ? "الكمية" : "Quantity"}: ${quantity}`],
      [`${language === "ar" ? "القسم" : "Department"}: ${department}`]
    ];
    
    let yPos = 40;
    content.forEach(line => {
      doc.text(line[0], 20, yPos);
      yPos += 10;
    });
    
    // Save PDF
    doc.save(`receipt-${transactionId}.pdf`);
  };

  const handleDispense = () => {
    if (!selectedItem || !quantity || !department) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar"
          ? "الرجاء ملء جميع الحقول المطلوبة"
          : "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }
    
    dispenseItemMutation.mutate({
      itemId: selectedItem,
      quantity,
      department
    });
  };

  return (
    <div className="p-6">
      <h1 className={`text-2xl font-bold mb-6 ${language === "ar" ? "font-arabic" : "font-english"}`}>
        {language === "ar" ? "صرف المخزون" : "Dispense Inventory"}
      </h1>
      
      <Card className="max-w-md mx-auto p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              {language === "ar" ? "الصنف" : "Item"}
            </Label>
            <Select onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "اختر الصنف" : "Select item"} />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {language === "ar" ? item.nameAr : item.name} ({item.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {language === "ar" ? "الكمية" : "Quantity"}
            </Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>
              {language === "ar" ? "القسم" : "Department"}
            </Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <Button onClick={handleDispense} className="w-full">
            {language === "ar" ? "صرف" : "Dispense"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
