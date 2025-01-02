import {
  AfterViewInit,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { KitchenComponent } from '../kitchen/kitchen.component';
import { ToastrService } from 'ngx-toastr';
import { fail } from 'node:assert';


interface Item {
  imageUrl: any;
  itemId: number;
  imageBase64: string;
  itemName: string;
  itemPrice: number;
  image: string;
}

interface Topping {
  toppingId: number;
  toppingName: string;
  toppingPrice: number;
}

interface MenuBucketItem {
  item: Item;
  quantity: number;
  selectedToppings: Topping[];
  itemDisplayName: string;
}

@Component({
  selector: 'app-mainpage',
  templateUrl: './mainpage.component.html',
  styleUrl: './mainpage.component.css',
})
export class MainpageComponent {
  isMobileView: boolean = false;
  menuItems: Item[] = [];
  menuBucket: MenuBucketItem[] = [];
  toppings: Topping[] = [];
  parcelCharges: number = 0;
  extraCharges: number = 0;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private toast: ToastrService
  ) {}


  ngOnInit(): void {
    this.loadItems();
    this.loadToppings();
    this.checkScreenSize();
  }


  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobileView = window.innerWidth < 768;
  }

  resetOrder(): void {
    this.menuBucket = []; 
    this.extraCharges = 0; 
    this.parcelCharges = 0; 
  }

  loadItems(): void {
    this.adminService.getitems().subscribe({
      next: (data) => {
        this.menuItems = data;
      },
      error: (err) => {
        console.error('Error fetching menu items', err);
      },
    });
  }

  loadToppings(): void {
    this.adminService.gettoppings().subscribe({
      next: (data) => {
        // console.log(data);
        this.toppings = data;
      },
      error: (err) => {
        console.log(err);
        console.error('Error fetching toppings', err);
      },
    });
  }

  addToMenuBucket(item: Item): void {
    if(window.innerWidth < 768){
      this.isMobileView = false
    }else{
      this.isMobileView = true
    }
    // Push a new item to the menuBucket regardless of whether it exists
    this.menuBucket.push({
      item,
      quantity: 1,
      selectedToppings: [],
      itemDisplayName: item.itemName,
    });
  }



  removeFromMenuBucket(index: number): void {
    const bucketItem = this.menuBucket[index];
    const toppingTotal = bucketItem.selectedToppings.reduce(
      (sum, topping) => sum + topping.toppingPrice * bucketItem.quantity,
      0
    );
    this.extraCharges -= toppingTotal;
    this.menuBucket.splice(index, 1);
  }



  toggleTopping(bucketIndex: number, topping: Topping): void {
    const selectedToppings = this.menuBucket[bucketIndex].selectedToppings;
    const toppingIndex = selectedToppings.findIndex(
      (t) => t.toppingId === topping.toppingId
    );

    const quantity = this.menuBucket[bucketIndex].quantity; 
    const toppingTotalPrice = topping.toppingPrice * quantity; 

    if (toppingIndex > -1) {
        selectedToppings.splice(toppingIndex, 1);
        this.extraCharges -= toppingTotalPrice; 
    } else {
       
        selectedToppings.push(topping);
        this.extraCharges += toppingTotalPrice; 
    }

    this.updateItemDisplayName(bucketIndex);
}

updateQuantity(index: number, change: number): void {
    const oldQuantity = this.menuBucket[index].quantity;
    const newQuantity = oldQuantity + change;

    if (newQuantity > 0) {
        this.menuBucket[index].quantity = newQuantity;

        
        const selectedToppings = this.menuBucket[index].selectedToppings;
        let toppingTotalPrice = 0;

        selectedToppings.forEach(topping => {
            const toppingPriceDifference = topping.toppingPrice * (newQuantity - oldQuantity);
            toppingTotalPrice += toppingPriceDifference;
        });

        this.extraCharges += toppingTotalPrice;
    }
}


  updateItemDisplayName(bucketIndex: number): void {
    const bucketItem = this.menuBucket[bucketIndex];
    const toppingNames = bucketItem.selectedToppings
      .map((t) => t.toppingName)
      .join(' + ');
    bucketItem.itemDisplayName =
      bucketItem.item.itemName + (toppingNames ? ' + ' + toppingNames : '');
  }

  onParcelChargesChange(event: any): void {
    this.parcelCharges = parseFloat(event.target.value) || 0;
  }

  getSubTotal(): number {
    return this.menuBucket.reduce((total, bucketItem) => {
      const itemTotal = bucketItem.item.itemPrice * bucketItem.quantity;
      const toppingsTotal = bucketItem.selectedToppings.reduce(
        (sum, topping) => sum + topping.toppingPrice,
        0
      );
      return total + itemTotal;
    }, 0);
  }

  getGrandTotal(): number {
    const subTotal = this.getSubTotal();
    return subTotal + this.extraCharges + this.parcelCharges;
  }

  submitOrder(paymentMode: string): void {
    const orderData = {
      saleItemsHelpers: this.menuBucket.map((item) => ({
        item: {
          itemId: item.item.itemId,
          itemName: item.item.itemName,
          itemPrice: item.item.itemPrice,
        },

        toppings: item.selectedToppings.map((topping) => ({
          toppingId: topping.toppingId,

          toppingName: topping.toppingName,
          toppingPrice: topping.toppingPrice,
        })),
        saleQty: item.quantity,
      })),
      subTotal: this.getSubTotal(),
      extraCharges: this.extraCharges,
      parcelCharges: this.parcelCharges,
      finalTotal: this.getGrandTotal(),
      paymentMode: paymentMode,
    };
    if (this.menuBucket.length === 0) {
      this.toast.info('Select Menu');
    } else {
      this.adminService.addsales(orderData).subscribe(res => {
          this.resetOrder();
          this.router.navigate(['/home/bill'], { state: { orderData } }); // Redirect with order data
      });      
    }
  }
}
