using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace ConsoleApp1
{
    internal class Program
    {
        static void Print(int number) => Console.WriteLine(number);
        static void Print(ref int number) => Console.WriteLine(++number);

        class Animal
        {
            public virtual void Eat() => Console.WriteLine("Animal Eat");
        }

        class Cat : Animal
        {
            public override void Eat() => base.Eat();
        }

        class Parent
        {
            public virtual void Work() => Console.WriteLine("프로그래머");
        }

        class Child : Parent
        {
            public override sealed void Work() => base.Work();
        }
        class GrandChild : Child
        {
           // public override void Work() => Console.WriteLine("프로게이머");
            public void Play() => Console.WriteLine("프로게이머");
        }

        
        static void Main(string[] args)
        {
            var number = 100;
            Print(number); //100
            Print(ref number); //101
            Print(number);//101

            (new Parent()).Work();
            (new Child()).Work();
            (new GrandChild()).Work();
            (new GrandChild()).Play();
            
        }
    }
}
