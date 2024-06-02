using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


namespace _240513
{
    /*public class ClassCode
    {

    }
    internal class Program
    {
        static void Main(string[] args)
        {
            ClassCode objectCode1 = new ClassCode();
            Console.Write(objectCode1.GetHashCode());
            var objectCode2 = new ClassCode();
            Console.Write(objectCode2.GetHashCode());
        }
    }*/

    /*public class Counter
    {
        public void GetTodayVisitCount()
        {
            Console.WriteLine("오늘 1234명이 접속했습니다.");
        }
    }

    class ObjectNote
    {
        static void Main()
        {
            Counter counter = new Counter();
            counter.GetTodayVisitCount();
        }
    }*/

    /*class ObjectDemo
    {
        static void Main()
        {
            var hong = new { Name = "홍길동", age = 21 };
            var park = new { Name = "박문수", age = 20 };

            Console.WriteLine($"이름 : {hong.Name} 나이 : {hong.age}");
            Console.WriteLine($"이름 : {park.Name} 나이 : {park.age}");
        }
    } */
    /*class ShareAndInstance
    {
        public static void StaticMember() => Console.WriteLine("[1] Static Member");
        public  void InstanceMember() => Console.WriteLine("[2] Instance Member");
    }

    class StaticAndinstance
    {
        static void Main()
        {
            ShareAndInstance.StaticMember();
            ShareAndInstance obj = new ShareAndInstance();
            obj.InstanceMember();
        }
    }*/

    /*  class My { }
      class Your
      {
          public override string ToString()
          {
              return "새로운 반환 문자열 지정";
          }
      }
      class ToStringMethod
      {
          static void Main()
          {
              My my = new My();
              Console.WriteLine(my);

              Your your = new Your();
              Console.WriteLine(your);
          }
      }*/
    /*using Korea.Seoul;
    using In = Korea.Incheon;
    namespace Korea
    {
        namespace Seoul
        {
            public class Car
            {
                public void Run() => Console.WriteLine("서울 자동차가 달립니다.");
            }
        }
        namespace Incheon
        {
            public class Car
            {
                public void Run() => Console.WriteLine("인천 자동차가 달립니다.");
            }
        }
    }
    static void Main()
    {
        Korea.Seoul.Car s = new Korea.Seoul.Car();
        s.Run();
        Korea.Incheon.Car i = new Korea.Incheon.Car();
        i.Run();

        Korea.Incheon.Car seoul = new Korea.Incheon.Car();
        seoul.Run();

        In.Car ic = new In.Car();
        ic.Run();
    }*/
    /* class Say
     {
         private string message = "안녕하세요";
         public void Hi()
         {
             this.message = "반갑습니다.";
             Console.WriteLine(this.message);
         }

     }

     public class Car
     {
         public static void Hi() { Console.WriteLine("Hi"); }
         private static void Bye() { Console.WriteLine("Bye"); }

         public static string name;
         public static int age;

         public static void SetAge(int intAge) { age = intAge; }
         public static int GetAge() { return age; }
     }

     class publicAndPrivate
     {
         static void Main()
         {
             Car.Hi();

             Car.name = "RedPlus"; Console.WriteLine(Car.name);
             Car.SetAge(21);
             Console.WriteLine(Car.GetAge());
         }
     }*/
    static void Main(string[] args)
    {
        Console.Title = "Version 1";
        List<Employee> employees = new List<Employee>();
        employees.Add(new Employee(1001, 3500m));
        employees.Add(new Employee(1002, 4500m));
        employees.Add(new Employee(1003, 3900m));
        foreach(Employee employee in employees)
        {
            Console.WriteLine($"Id : {employee.Id} Net Pay : " + $"{employee.CalculatePay():N2}");
        }
    }
}
