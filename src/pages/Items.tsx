
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ItemForm from "@/components/ItemForm";
import { useToast } from "@/hooks/use-toast";

export default function Items() {
  const [language, setLanguage] = useState<"en" | "ar">("ar");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const db = await getDB();
      return db.getAll("items");
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (newItem: any) => {
      const db = await getDB();
      const id = crypto.randomUUID();
      await db.add("items", {
        ...newItem,
        id,
        lastUpdated: new Date()
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: language === "ar" ? "تم بنجاح" : "Success",
        description: language === "ar" 
          ? "تم إضافة الصنف بنجاح"
          : "Item added successfully"
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = await getDB();
      await db.delete("items", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: language === "ar" ? "تم بنجاح" : "Success",
        description: language === "ar"
          ? "تم حذف الصنف بنجاح"
          : "Item deleted successfully"
      });
    }
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${language === "ar" ? "font-arabic" : "font-english"}`}>
          {language === "ar" ? "إدارة الأصناف" : "Items Management"}
        </h1>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              {language === "ar" ? "إضافة صنف جديد" : "Add New Item"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === "ar" ? "إضافة صنف جديد" : "Add New Item"}
              </DialogTitle>
            </DialogHeader>
            <ItemForm
              onSubmit={(data) => addItemMutation.mutate(data)}
              language={language}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items?.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-english font-medium">{item.name}</h3>
                <h3 className="font-arabic font-medium">{item.nameAr}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {language === "ar" ? "الكمية: " : "Quantity: "}
                  {item.quantity}
                </p>
                <p className="text-sm text-gray-600">
                  {language === "ar" ? "الفئة: " : "Category: "}
                  {item.category}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteItemMutation.mutate(item.id)}
              >
                {language === "ar" ? "حذف" : "Delete"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
