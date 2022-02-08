import { ChangeDetectionStrategy, Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { Remult, Field, Entity, EntityBase, BackendMethod, getFields, IdEntity, isBackend, DateOnlyField, Controller, Filter, IntegerField } from 'remult';

import { Products } from './products';
import { getValueList, GridSettings, InputField } from '@remult/angular/interfaces';

import axios, { AxiosResponse } from 'axios';
import { CdkScrollable, CdkVirtualScrollViewport, ScrollDispatcher } from '@angular/cdk/scrolling';
import { filter, map, pairwise, throttleTime } from 'rxjs/operators';
import { timer } from 'rxjs';
import { DialogConfig } from '../../../../angular';


@Controller("blabla")

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
  //,changeDetection: ChangeDetectionStrategy.OnPush
})
@DialogConfig({
  height: '1500px'
})
export class ProductsComponent implements OnInit {
  page = 0;
  constructor(private remult: Remult) {

  }
  grid = new GridSettings(this.remult.repo(stam));
  ngOnInit(): void {
    stam.myMethod();
  }
  async click() {

  }

}



@Entity("testId", {
  allowApiCrud: true,
  dbAutoIncrementId: true
})
export class TestId extends EntityBase {
  @IntegerField({
    dbReadOnly: true
  })
  id: number;
  @Field()
  name: string;

}
@Entity<stam>('stam', {
  allowApiCrud: true,
  saving: self => {
    console.log(self.test);
    if (isBackend() && false) {
      var x = undefined;
      x.toString();
      self.$.name.error = 'name error';
    }
  }
})
export class stam extends IdEntity {
  @Field({ dbName: 'name' })
  name: string;
  @DateOnlyField({ allowNull: true })
  stamDate?: Date

  @Field({ serverExpression: () => 'noam' })
  test: string = '';
  @Field()
  testId: TestId;

  @BackendMethod({ allowed: false })
  static async myMethod(remult?: Remult) {

  }
}


