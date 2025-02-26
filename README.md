
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>أمر/طلب صرف مخزني</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f0f0;
        }
        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .header div {
            display: flex;
            align-items: center;
        }
        .header span {
            font-weight: bold;
            margin-left: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: right;
        }
        th {
            background-color: #f2f2f2;
        }
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        .signature {
            text-align: center;
        }
        input[type="text"] {
            width: 100%;
            padding: 5px;
            border: none;
            border-bottom: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>أمر/طلب (صرف مخزني)</h1>
        <div class="header">
            <div>
                <span>اليوم:</span>
                <input type="text">
            </div>
            <div>
                <span>التاريخ:</span>
                <input type="text">
            </div>
            <div>
                <span>القسم:</span>
                <input type="text">
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>م</th>
                    <th>الصنف</th>
                    <th>الكمية</th>
                    <th>الوحدة</th>
                    <th>السعة/العبوة</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                <!-- 10 صفوف للإدخال -->
                <tr>
                    <td>1</td>
                    <td><input type="text"></td>
                    <td><input type="text"></td>
                    <td><input type="text"></td>
                    <td><input type="text"></td>
                    <td><input type="text"></td>
                </tr>
                <!-- كرر هذا الصف 9 مرات أخرى مع تغيير الرقم -->
            </tbody>
        </table>
        <div class="signatures">
            <div class="signature">
                <p>المستلم:</p>
                <input type="text">
                <p>التوقيع:
