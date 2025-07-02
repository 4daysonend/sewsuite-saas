import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ErrorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  errorId: string;

  @Column()
  message: string;

  @Column('text')
  stack: string;

  @Column()
  name: string;

  @Column('json')
  context: Record<string, any>;

  @Column()
  timestamp: Date;

  @Column()
  environment: string;
}
