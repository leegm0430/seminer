using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    internal class Program
    {
        /* public class Record
         {
             public string Name { get; set; }
             public string PhoneNumber { get; set; }
             public DateTime BirthDate{ get; set;}
             public string AuthCode { get; set; }

         }*/

        public abstract class Item
        {
            public string Description { get; set; }
            public decimal Price { get; set; }
            public string Sku { get; set; }

            public Item(string description, decimal price, string sku)
            {
                Description = description;
                Price = price;
                Sku = sku;
            }

            public abstract decimal CalculateTotalPrice(int quantity);
        }
        static void Main(string[] args)
    {
           /* string data = "안녕하세요. \r\n반갑습니다." + Environment.NewLine + "또 만나요";

            StreamWriter sw = new StreamWriter("C:\\sem\\C#\\Result.txt");

            sw.WriteLine(data);
            sw.Close();
            sw.Dispose();

            StreamReader sr = new StreamReader(@"C:\sem\C#\Result.txt");

            Console.WriteLine("{0}", sr.ReadToEnd());

            sr.Close();
            sr.Dispose();*/

            /*string file = "C:\\sem\\C#\\Result.txt";
            if(File.Exists(file)) 
            {
                Console.WriteLine("{0}", File.GetCreationTime(file));
                File.Copy(file, "C:\\sem\\C#\\Result2.txt", true);
            }

            FileInfo fi = new FileInfo(file);
            if(fi.Exists) 
            {
                Console.WriteLine($"{fi.FullName}");
            }*/
            string[] lines = System.IO.File.ReadAllLines(@"C:\sem\C#\\Result.txt", System.Text.Encoding.Default);
            foreach (var line in lines)
            {
                Console.WriteLine(line);
            }

            /*List<Record> records = new List<Record>();
            foreach (var line in lines)
            {
                string[] splitData = line.Split(',');
                records.Add(new Record
                {
                    Name = splitData[0],
                    PhoneNumber = splitData[1],
                    BirthDate = Convert.ToDateTime(splitData[2]),
                    AuthCode = splitData[3]
                });
            }
            Console.WriteLine(records[0]?.Name ?? "데이터가 없습니다.");*/
            List<GroceryItem> items = new List<GroceryItem>();
            foreach (var line in lines)
            {
                string[] splitData = line.Split(',');
                items.Add(new GroceryItem
                {
                    Description = splitData[0],
                    Price = splitData[1],
                    ExpirationDate = Convert.ToDateTime(splitData[2]),
                    Sku = splitData[3]
                });
            }
            Console.WriteLine(items[0]?.Description ?? "데이터가 없습니다.");
            Console.Title = "Version 2";
            List<Employee> employees = new List<Employee>();
            employees.Add(new SalaryEmployee(1001, 3500m));
            employees.Add(new SalaryEmployee(1002, 4500m));
            employees.Add(new SalaryEmployee(1003, 3900m));

            employees.Add(new HourlyEmployee(1004, 20m, 150));
            employees.Add(new HourlyEmployee(1005, 18m, 150));

            foreach (Employee employee in employees) 
            {
                Console.WriteLine($"Id: {employee.Id} Net Pay : {employee.CalculatePay()}");
            }
             
            List<IPayable> payables = new List<IPayable>();
            payables.Add(new SalaryEmployee(1001, 3500m));
            payables.Add(new SalaryEmployee(1002,4500m));
            payables.Add(new SalaryEmployee(1003, 3900m));
            payables.Add(new HourlyEmployee(1004, 20m, 150));
            payables.Add(new HourlyEmployee(1005, 18m, 150));
            payables.Add(new CommissionEmployee(1006, 60000m, 0.06));
            payables.Add(new Vendor(5001, 8655m));
            foreach(IPayable payable in payables)
            {
                Console.WriteLine($"Id : {payable.Id} " + $"Net Pay: {payable.CalculatePay():N2}");
            }


        }

}
}

