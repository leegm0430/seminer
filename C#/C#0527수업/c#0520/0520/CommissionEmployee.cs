using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
     class CommissionEmployee : Employee
    {
        public decimal Sales { get; }
        public double CommissionRate { get; }

        public CommissionEmployee(int id, decimal sales, double commissionRate) : base(id)
        { 
            Sales = sales;
            CommissionRate = commissionRate;
        }
        public override decimal CalculatePay()
        {
            return Sales * (decimal) CommissionRate;
        }
    }
}
