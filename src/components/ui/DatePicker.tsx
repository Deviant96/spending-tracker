import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

const isValidDate = (date: Date) => !isNaN(date.getTime());

const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
    });

type DatePickerProps = {
    id?: string;
    placeholder?: string;
    helperText?: string;
    onDateChange?: (date: Date | undefined) => void;
    autoFocus: boolean;
};

const DatePicker: React.FC<DatePickerProps> = ({ id = "date", placeholder = "Select a date", helperText, onDateChange, autoFocus }) => {
    const [value, setValue] = useState<string>("");
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [month, setMonth] = useState<Date | undefined>(undefined);
    const [open, setOpen] = useState<boolean>(false);

    return (
        <div className="relative flex flex-col gap-2">
            <div className="relative flex gap-2">
                <Input
                    id={id}
                    value={value}
                    placeholder={placeholder}
                    className="bg-background pr-10"
                    onChange={(e) => {
                        const date = new Date(e.target.value);
                        setValue(e.target.value);
                        if (isValidDate(date)) {
                            setDate(date);
                            setMonth(date);
                            onDateChange?.(date);
                        } else {
                            onDateChange?.(undefined);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setOpen(true);
                        }
                    }}
                    autoFocus={autoFocus}
                />
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id={`${id}-picker`}
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                        >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Select date</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                        alignOffset={-8}
                        sideOffset={10}
                    >
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={(date) => {
                                setDate(date);
                                if (date) {
                                    setValue(formatDate(date));
                                    onDateChange?.(date);
                                } else {
                                    onDateChange?.(undefined);
                                }
                                setOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
        </div>
    );
};

export default DatePicker;