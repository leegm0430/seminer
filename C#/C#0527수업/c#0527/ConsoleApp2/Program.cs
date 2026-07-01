using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ConsoleApp2
{
    internal class Program
    {
        
        interface IBattery
        {
            string GetName();
        }

        class Good : IBattery
        {
            public string GetName() => "Good";
        }

        class Bad : IBattery
        {
            public string GetName() => "Bad";
        }

        class Car
        {
            private IBattery _battery;
            public Car(IBattery battery)
            {
                _battery = battery;
            }
            public void Run() => Console.WriteLine("{0} 배터리를 장착한 자동차가 달립니다.", _battery.GetName());
        }

        interface IDog
        {
            void Eat();
        }

        interface ICat
        {
            void Eat();
        }

        class Pet : IDog, ICat
        {
            void IDog.Eat() => Console.WriteLine("Dog Eat");
            void ICat.Eat() => Console.WriteLine("Cat Eat");
        }
        static void Main(string[] args)
        {
            var good = new Car(new Good()); //Good Run();
            new Car(new Bad()).Run();

            Pet pet = new Pet();
            ((IDog)pet).Eat();
            ((ICat)pet).Eat();

            IDog dog = new Pet();
            dog.Eat();
            ICat cat = new Pet();
            cat.Eat();
        }
    }
}
