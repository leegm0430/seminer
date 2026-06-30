using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ConsoleApp3
{
    internal class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "Version 1";
            List<Employee> employees = new List<Employee>();
            employees.Add(new Employee(1001, 3500m));
            employees.Add(new Employee(1002, 4500m));
            employees.Add(new Employee(1003, 3900m));
            foreach (Employee employee in employees)
            {
                Console.WriteLine($"Id : {employee.Id} Net Pay : " + $"{employee.CalculatePay():N2}");
            }
        }
    }
}
