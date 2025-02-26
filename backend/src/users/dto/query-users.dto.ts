export class QueryUsersDto {
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
  
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
  
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;
  
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;
  
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;
  
    @IsOptional()
    @IsString()
    searchTerm?: string;
  
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';
  
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
  }