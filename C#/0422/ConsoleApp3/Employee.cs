using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ConsoleApp3
{
    class Employee
    {
        public int Id { get; }
        public decimal Salary { get; }
        public Employee(int id, decimal salary)
        {
            Id = id;
            Salary = salary;
        }

        public decimal CalculatePay()
        {
            return Salary;
        }
    }
}
