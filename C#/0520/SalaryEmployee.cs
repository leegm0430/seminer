using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    internal class SalaryEmployee : Employee
    {
        public decimal Salary { get; }

        public SalaryEmployee(int id, decimal salary)
        : base(id)
        {
            Salary = salary;
        }

        public override decimal CalculatePay()
        {
            return Salary;
        }
        
    }
}
