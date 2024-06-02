using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace _0520
{
    internal class HourlyEmployee:Employee
    {
        public decimal Wage;
        public double Hours { get; }
        public HourlyEmployee(int id, decimal wage, double hours) :base(id)
        {
            Wage = wage;
            Hours = hours;
        }
          
        public override decimal CalculatePay()
        {
            return Wage * (decimal)Hours;
        }
    }
}
